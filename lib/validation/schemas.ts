import { z } from "zod";

export const albumCreateSchema = z.object({
  title: z.string().trim().min(1, "相册标题不能为空").max(120, "相册标题过长"),
  description: z.string().trim().max(2_000, "相册描述过长").default(""),
  isPublic: z.boolean().default(true),
  accessKey: z.string().trim().max(120, "相册访问密钥过长").default("")
}).refine((value) => value.isPublic || value.accessKey.length > 0, {
  message: "非公开相册必须设置访问密钥",
  path: ["accessKey"]
});

export const albumUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "相册标题不能为空").max(120, "相册标题过长").optional(),
    description: z.string().trim().max(2_000, "相册描述过长").optional(),
    isPublic: z.boolean().optional(),
    accessKey: z.string().trim().max(120, "相册访问密钥过长").optional(),
    coverImageId: z.string().trim().min(1).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要更新一个字段"
  });

export const imageUpdateSchema = z
  .object({
    title: z.string().trim().max(160, "图片标题过长").optional(),
    description: z.string().trim().max(2_000, "图片描述过长").optional(),
    sortOrder: z.number().int().min(0).max(1_000_000).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要更新一个字段"
  });

export const imageUploadMetadataSchema = z.object({
  title: z.string().trim().max(160, "图片标题过长").default(""),
  description: z.string().trim().max(2_000, "图片描述过长").default("")
});

export type AlbumCreateInput = z.infer<typeof albumCreateSchema>;
export type AlbumUpdateInput = z.infer<typeof albumUpdateSchema>;
export type ImageUpdateInput = z.infer<typeof imageUpdateSchema>;
export type ImageUploadMetadataInput = z.infer<typeof imageUploadMetadataSchema>;
