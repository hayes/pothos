export interface User {
  id: number;
  displayName: string;
}

export interface Customer extends User {
  age: number;
}
