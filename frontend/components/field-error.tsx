// 行内校验提示:放在输入框下面,错误改对前一直显示(不用 toast 一闪而过)
export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
