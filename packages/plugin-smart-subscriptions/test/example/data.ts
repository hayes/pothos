export class Poll {
  static map = new Map<number, Poll>();

  static lastID = 0;

  id: number;

  question: string;

  answers: string[];

  results: Map<string, number>;

  constructor(question: string, answers: string[]) {
    this.id = Poll.lastID + 1;

    this.question = question;
    this.answers = answers;

    this.results = new Map();

    this.answers.forEach((answer) => {
      this.results.set(answer, 0);
    });

    Poll.lastID = this.id;
  }

  static create(question: string, answers: string[]) {
    const poll = new Poll(question, answers);

    this.map.set(poll.id, poll);

    return poll;
  }
}
