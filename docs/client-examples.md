# app 端接入示例

接口只有一个:

```
GET https://flags.example.com/api/v1/config/<slug>/<env>
```

- 不带凭证 → 只返回 `public` 参数;带 `X-Api-Key: <server key>` → 连 `private` 一起返回(只在自己的后端用,别埋进 app)
- 返回一层扁平 JSON,key 原样(`Group:Key`),值已按类型转成真值:

```json
{
  "App:Announcement": { "visible": true, "title": "Hi" },
  "App:MinVersion": "3.1.0",
  "Features:BiometricLogin": true,
  "Onboarding:Steps": [1, 2, 3]
}
```

- 响应带弱 `ETag`;下次请求带 `If-None-Match` 没变化就 `304` 空体
- 404 应用或环境不存在,401 server key 错

下面三段都是同一个套路:**启动先用上次缓存(没有就用内置默认值)→ 后台拉一次 → 有变化就替换并落盘**。app 永远不会因为拉不到配置而没值可用。

## JavaScript / TypeScript(浏览器、React Native、Node 18+)

```ts
type ConfigMap = Record<string, unknown>;

interface Snapshot {
  etag: string | null;
  config: ConfigMap;
}

export class RemoteConfig {
  private snapshot: Snapshot;

  constructor(
    private readonly url: string,
    private readonly defaults: ConfigMap,
    // 浏览器传 localStorage;RN 传 AsyncStorage 的包装;Node 传一个读写文件的对象
    private readonly storage: {
      getItem(key: string): string | null;
      setItem(key: string, value: string): void;
    },
    private readonly storageKey = 'remote-config',
  ) {
    const cached = storage.getItem(storageKey);
    this.snapshot = cached ? (JSON.parse(cached) as Snapshot) : { etag: null, config: {} };
  }

  // 读值:缓存 > 默认值;泛型只是告诉调用方类型,不做运行时校验
  get<T>(key: string, fallback?: T): T {
    if (key in this.snapshot.config) return this.snapshot.config[key] as T;
    if (key in this.defaults) return this.defaults[key] as T;
    return fallback as T;
  }

  // 拉一次;网络失败静默,继续用缓存。返回是否有更新
  async refresh(): Promise<boolean> {
    try {
      const response = await fetch(this.url, {
        headers: this.snapshot.etag ? { 'If-None-Match': this.snapshot.etag } : {},
      });
      if (response.status === 304) return false;
      if (!response.ok) return false;
      this.snapshot = {
        etag: response.headers.get('etag'),
        config: (await response.json()) as ConfigMap,
      };
      this.storage.setItem(this.storageKey, JSON.stringify(this.snapshot));
      return true;
    } catch {
      return false;
    }
  }
}

// 用法
const config = new RemoteConfig(
  'https://flags.example.com/api/v1/config/my-app/prod',
  { 'Features:BiometricLogin': false, 'App:MinVersion': '1.0.0' },
  localStorage,
);
void config.refresh();                                      // 启动时拉一次,不阻塞渲染
setInterval(() => void config.refresh(), 5 * 60 * 1000);    // 之后每 5 分钟
if (config.get<boolean>('Features:BiometricLogin')) { /* ... */ }
```

## Kotlin(Android,OkHttp)

```kotlin
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

class RemoteConfig(
    context: Context,
    private val url: String,
    private val defaults: JSONObject,
) {
    private val prefs = context.getSharedPreferences("remote-config", Context.MODE_PRIVATE)
    private val client = OkHttpClient()

    @Volatile private var config = JSONObject(prefs.getString("config", "{}") ?: "{}")
    @Volatile private var etag = prefs.getString("etag", null)

    // 读值:缓存 > 默认值 > fallback
    fun getBoolean(key: String, fallback: Boolean = false) =
        if (config.has(key)) config.getBoolean(key) else defaults.optBoolean(key, fallback)
    fun getString(key: String, fallback: String = "") =
        if (config.has(key)) config.getString(key) else defaults.optString(key, fallback)
    fun getJson(key: String): JSONObject? =
        config.optJSONObject(key) ?: defaults.optJSONObject(key)

    // 拉一次;失败静默。返回是否有更新
    suspend fun refresh(): Boolean = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder().url(url).apply {
                etag?.let { header("If-None-Match", it) }
            }.build()
            client.newCall(request).execute().use { response ->
                if (response.code == 304 || !response.isSuccessful) return@withContext false
                val body = response.body?.string() ?: return@withContext false
                config = JSONObject(body)
                etag = response.header("ETag")
                prefs.edit().putString("config", body).putString("etag", etag).apply()
                true
            }
        }.getOrDefault(false)
    }
}

// 用法(Application.onCreate 或首个 ViewModel)
val remoteConfig = RemoteConfig(
    context,
    "https://flags.example.com/api/v1/config/my-app/prod",
    JSONObject(mapOf("Features:BiometricLogin" to false, "App:MinVersion" to "1.0.0")),
)
lifecycleScope.launch { remoteConfig.refresh() }
if (remoteConfig.getBoolean("Features:BiometricLogin")) { /* ... */ }
```

## Swift(iOS,URLSession + async/await)

```swift
import Foundation

final class RemoteConfig {
    private let url: URL
    private let defaults: [String: Any]
    private let store = UserDefaults.standard
    private var config: [String: Any]
    private var etag: String?

    init(url: URL, defaults: [String: Any]) {
        self.url = url
        self.defaults = defaults
        self.config = store.dictionary(forKey: "remote-config.config") ?? [:]
        self.etag = store.string(forKey: "remote-config.etag")
    }

    // 读值:缓存 > 默认值 > fallback
    func get<T>(_ key: String, default fallback: T) -> T {
        (config[key] as? T) ?? (defaults[key] as? T) ?? fallback
    }

    // 拉一次;失败静默。返回是否有更新
    @discardableResult
    func refresh() async -> Bool {
        var request = URLRequest(url: url)
        if let etag { request.setValue(etag, forHTTPHeaderField: "If-None-Match") }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse else { return false }
        if http.statusCode == 304 || !(200..<300).contains(http.statusCode) { return false }
        guard let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return false }
        config = parsed
        etag = http.value(forHTTPHeaderField: "ETag")
        store.set(parsed, forKey: "remote-config.config")
        store.set(etag, forKey: "remote-config.etag")
        return true
    }
}

// 用法
let remoteConfig = RemoteConfig(
    url: URL(string: "https://flags.example.com/api/v1/config/my-app/prod")!,
    defaults: ["Features:BiometricLogin": false, "App:MinVersion": "1.0.0"]
)
Task { await remoteConfig.refresh() }
if remoteConfig.get("Features:BiometricLogin", default: false) { /* ... */ }
```

## 几个约定

- **默认值写在 app 里**,配置中心是覆盖层;新装 app 第一次启动时网络还没回来,靠默认值也能跑
- **别在启动路径上 `await refresh()`**,拉取是后台事;真需要"拿到最新值再进主页"的场景(如强更检查)再单独等
- `private` 参数只给自己的服务端读,server key 不要进 app 包
- 想让配置"立即生效"就把轮询间隔调短;想省流量就依赖 ETag,304 几乎不花流量
