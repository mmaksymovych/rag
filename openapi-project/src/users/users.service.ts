import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  private readonly mockUsers: User[] = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: '2024-01-15T10:30:00Z',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      createdAt: '2024-01-16T11:45:00Z',
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob.johnson@example.com',
      createdAt: '2024-01-17T09:20:00Z',
    },
  ];

  findAll(): User[] {
    return this.mockUsers;
  }

  findOne(id: number): User | undefined {
    return this.mockUsers.find((user) => user.id === id);
  }
}

