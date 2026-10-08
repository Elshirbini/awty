import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';

export class SubscribeDto {
  @IsIn(['subscribe', 'unsubscribe'])
  type!: 'subscribe' | 'unsubscribe';

  @IsNotEmpty()
  @IsUUID()
  taskId!: string;
}
