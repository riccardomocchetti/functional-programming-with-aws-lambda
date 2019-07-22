import { UserPost } from "./model";

export class DB {

  public static inMemory = () => new DB();

  private posts: UserPost[];

  private constructor() {
    this.posts = [
      {user: 'John', title: 'First post', text: 'John\'s first post'},
      {user: 'John', title: 'Second post', text: 'John\'s second post'},
      {user: 'John', title: 'Third post', text: 'John\'s third post'}
    ];
  }

  public createPost = (post: UserPost) => {
    this.posts.push(post);
    return Promise.resolve(post);
  }

  public listPosts = () => Promise.resolve(this.posts);
}
