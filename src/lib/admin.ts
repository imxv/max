import { auth, currentUser } from '@clerk/nextjs/server';

export async function isAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return false;
    }

    const user = await currentUser();
    if (!user) {
      return false;
    }

    // 检查用户的 publicMetadata 中是否有 admin 角色
    const userRole = user.publicMetadata?.role as string | undefined;
    return userRole === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function requireAdmin() {
  const adminStatus = await isAdmin();
  if (!adminStatus) {
    throw new Error('Admin access required');
  }
  return adminStatus;
}