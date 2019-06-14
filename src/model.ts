
export class DB {
  private posts: UserPost[];

  public constructor() {
    this.posts = [];
  }

  public createPost = (post: UserPost) => {
    this.posts.push(post);

    return post;
  }

  public listPosts = () => this.posts;
}

export interface UserPost {
  user: string;
  title: string;
  text: string;
}

export interface UserPostEvent {
  pathParameters: { [name: string]: string } | null;
  queryStringParameters: { [name: string]: string } | null;
  body: UserPost | null;
}
