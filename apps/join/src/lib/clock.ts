export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private readonly instant: Date;

  constructor(instant: Date) {
    this.instant = new Date(instant.getTime());
  }

  now(): Date {
    return new Date(this.instant.getTime());
  }
}
