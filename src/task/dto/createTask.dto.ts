import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(3600)
  duration!: number;
}
