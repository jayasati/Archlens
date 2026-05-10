export interface UserDto {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  githubUsername: string | null;
  createdAt: string;
}
