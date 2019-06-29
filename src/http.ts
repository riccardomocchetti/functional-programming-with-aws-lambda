
export interface HttpHeaders {
  [key: string]: string;
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
};

export class StatusCodes {
  public static readonly OK = 200;
  public static readonly CREATED = 201;
  public static readonly BAD_REQUEST = 400;
  public static readonly SERVER_ERROR = 500;
}

export class ApplicationError {
  public readonly message: string;
  public readonly errors: string[];
  public readonly statusCode: StatusCodes;

  public constructor(message: string, errors: string[], status: StatusCodes) {
    this.message = message;
    this.errors = errors;
    this.statusCode = status;
  }
}

export class HttpResponse<T> {

  public static fromResult<T>(statusCode: StatusCodes, result: T, headers: HttpHeaders = DEFAULT_HEADERS) {
    return new HttpResponse<T>(
      statusCode,
      headers,
      JSON.stringify(result)
    );
  }

  public static fromError(statusCode: StatusCodes, error: ApplicationError, headers: HttpHeaders = DEFAULT_HEADERS) {
    return new HttpResponse(
      statusCode,
      headers,
      JSON.stringify({ message: error.message, errors: error.errors })
    );
  }

  public readonly statusCode: StatusCodes;
  public readonly headers: HttpHeaders;
  public readonly body: string;

  private constructor(statusCode: StatusCodes, headers: HttpHeaders, body: string) {
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
  }
}
