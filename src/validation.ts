import { APIGatewayEvent } from "aws-lambda";
import { fromNullable, fromPredicate, tryCatch2v } from 'fp-ts/lib/Either';
import { ApplicationError, StatusCodes } from './http';
import { UserPostEvent } from './model';

const parseCreateEventBody = (event: APIGatewayEvent) =>
  tryCatch2v<ApplicationError, UserPostEvent>(
    () => {
      const parsedBody = event.body !== null
        ? JSON.parse(event.body)
        : null;

      return { ...event, body: parsedBody };
    },
    () => new ApplicationError(
      'Error parsing request body',
      ['Invalid JSON'],
      StatusCodes.BAD_REQUEST
    )
  );

const validateBodyNotNull = (createEvent: UserPostEvent) =>
  fromNullable(new ApplicationError(
    'Error parsing request body',
    ['Body cannot be empty'],
    StatusCodes.BAD_REQUEST)
  )(createEvent.body)
  .map((body) => ({
    ...createEvent,
    body
  }));

const validateQueryParams = (event: APIGatewayEvent) =>
  fromPredicate(
    (params) => params === null,
    () => new ApplicationError(
      'Error parsing request query params',
      ['Query params should be empty'],
      StatusCodes.BAD_REQUEST
    )
  )(event.queryStringParameters);

const validatePathParams = (event: APIGatewayEvent) =>
  fromPredicate(
    (params) => params === null,
    () => new ApplicationError(
      'Error parsing request path params',
      ['Path params should be empty'],
      StatusCodes.BAD_REQUEST
    )
  )(event.pathParameters);

export const validateCreatePostEvent = (event: APIGatewayEvent) =>
  validatePathParams(event)
    .chain(() => validateQueryParams(event))
    .chain(() => parseCreateEventBody(event))
    .chain((createEvent) => validateBodyNotNull(createEvent));

export const validateListPostsEvent = (event: APIGatewayEvent) =>
  validatePathParams(event)
    .chain(() => validateQueryParams(event));
