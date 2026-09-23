export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Order {
  id: string;
  userId: string;
  item: string;
  amount: number;
}

export interface CreateUserDto {
  name: string;
  email: string;
}

export interface CreateOrderDto {
  userId: string;
  item: string;
  amount: number;
}

