
export interface UserPost {
  user: string;
  title: string;
  text: string;
}

export interface UserPostEvent {
  pathParameters: { [name: string]: string } | null;
  queryStringParameters: { [name: string]: string } | null;
  body: UserPost;
}
