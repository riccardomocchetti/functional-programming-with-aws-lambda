import { exampleCreateEvent, exampleListEvent, exampleBadRequest } from './request-examples';
import { DB } from './store';
import { createPost, listPosts } from './service';
import { task } from 'fp-ts/lib/Task';

const db = DB.inMemory();

task.of(3)
  .chain(_ => createPost(exampleCreateEvent, db).map(console.log))
  .chain(_ => createPost(exampleBadRequest, db).map(console.log))
  .chain(_ => listPosts(exampleListEvent, db).map(console.log))
  .run();
