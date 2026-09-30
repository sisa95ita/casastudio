import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class DesignPoint3DDto {
  @IsNumber() x!: number;
  @IsNumber() y!: number;
  @IsNumber() z!: number;
}

export class DesignReferenceImageDto {
  @IsString()
  @MaxLength(6_500_000)
  @Matches(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/)
  dataUrl!: string;

  @IsIn(["image/png", "image/jpeg", "image/webp"])
  mimeType!: "image/png" | "image/jpeg" | "image/webp";

  @IsInt()
  @Min(1)
  @Max(4096)
  width!: number;

  @IsInt()
  @Min(1)
  @Max(4096)
  height!: number;
}

export class DesignReferenceCameraDto {
  @IsIn(["perspective"])
  projection!: "perspective";

  @ValidateNested()
  @Type(() => DesignPoint3DDto)
  position!: DesignPoint3DDto;

  @ValidateNested()
  @Type(() => DesignPoint3DDto)
  direction!: DesignPoint3DDto;

  @ValidateNested()
  @Type(() => DesignPoint3DDto)
  up!: DesignPoint3DDto;

  @IsNumber()
  @Min(1)
  @Max(179)
  verticalFovDegrees!: number;
}

export class DesignReferenceTargetDto {
  @IsIn(["room"])
  kind!: "room";

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  levelId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  roomId!: string;
}

export class DesignReferenceViewDto {
  @IsIn([
    "room-axonometric",
    "room-interior-a",
    "room-interior-b",
    "current-user-view"
  ])
  kind!:
    | "room-axonometric"
    | "room-interior-a"
    | "room-interior-b"
    | "current-user-view";

  @ValidateNested()
  @Type(() => DesignReferenceTargetDto)
  target!: DesignReferenceTargetDto;

  @ValidateNested()
  @Type(() => DesignReferenceImageDto)
  image!: DesignReferenceImageDto;

  @ValidateNested()
  @Type(() => DesignReferenceCameraDto)
  camera!: DesignReferenceCameraDto;
}

export class GenerateRoomDesignRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  levelId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  roomId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  instructions!: string;

  @ArrayMinSize(3)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => DesignReferenceViewDto)
  referenceViews!: DesignReferenceViewDto[];
}
