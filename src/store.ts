import { UserPost } from "./model";

export class DB {

  public static inMemory = () => new DB();

  private posts: UserPost[];

  private constructor() {
    this.posts = [];
  }

  public createPost = (post: UserPost) => {
    this.posts.push(post);
    return Promise.resolve(post);
  }

  public listPosts = () => Promise.resolve(this.posts);
}
