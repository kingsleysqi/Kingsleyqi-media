export async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  // 简单校验：你可以改成环境变量 TOKEN
  return token && token === env.ADMIN_TOKEN;
}