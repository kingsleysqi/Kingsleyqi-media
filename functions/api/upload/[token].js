export async function onRequest(context) {
  // 将你的 HTML 包装在字符串中返回
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>上传文件 | Kingsley Media</title>
    <style>
        body { background: #0a0c0f; color: #e2e8f0; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .box { background: #111318; padding: 30px; border-radius: 12px; border: 1px solid #1e2230; text-align: center; }
        .btn { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #4f9cf9; color: white; text-decoration: none; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>文件上传</h2>
        <p>正在为令牌 [ ${context.params.token} ] 准备上传环境...</p>
        <input type="file" id="f" multiple>
        <a href="#" class="btn" onclick="alert('上传逻辑对接中')">提交文件</a>
    </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8" }
  });
}
