export class Poll {
  static map = new Map<number, Poll>();

  static lastID = 0;

  static lastAnswerID = 0;

  id: number;

  question: string;

  answers: { id: number; value: string; count: number }[];

  constructor(question: string, answers: string[]) {
    this.id = Poll.lastID + 1;

    this.question = question;

    this.answers = answers.map((value) => {
      Poll.lastAnswerID += 1;

      return { value, id: Poll.lastAnswerID, count: 0 };
    });

    Poll.lastID = this.id;
  }

  static create(question: string, answers: string[]) {
    const poll = new Poll(question, answers);

    Poll.map.set(poll.id, poll);

    return poll;
  }

  static reset() {
    Poll.map = new Map<number, Poll>();
    Poll.lastID = 0;
    Poll.lastAnswerID = 0;
  }
}
