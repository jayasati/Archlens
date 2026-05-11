import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/repos/:path*',
    '/smells/:path*',
    '/integrations/:path*',
    '/account/:path*',
  ],
};
