
export type UserPost = {
  user: string;
  title: string;
  text: string;
};

export type UserPostEvent = {
  pathParameters: { [name: string]: string } | null;
  queryStringParameters: { [name: string]: string } | null;
  body: UserPost;
};
