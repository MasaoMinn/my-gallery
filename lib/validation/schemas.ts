import { z } from "zod";

export const albumCreateSchema = z.object({
  title: z.string().trim().min(1, "相册标题不能为空").max(120, "相册标题过长"),
  description: z.string().trim().max(2_000, "相册描述过长").default(""),
  isPublic: z.boolean().default(true)
});

export const albumUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "相册标题不能为空").max(120, "相册标题过长").optional(),
    description: z.string().trim().max(2_000, "相册描述过长").optional(),
    isPublic: z.boolean().optional(),
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

export const privateAlbumAccessKeyUpdateSchema = z.object({
  accessKey: z.string().trim().min(1, "非公开相册密钥不能为空").max(120, "非公开相册密钥过长")
});

export type AlbumCreateInput = z.infer<typeof albumCreateSchema>;
export type AlbumUpdateInput = z.infer<typeof albumUpdateSchema>;
export type ImageUpdateInput = z.infer<typeof imageUpdateSchema>;
export type ImageUploadMetadataInput = z.infer<typeof imageUploadMetadataSchema>;
export type PrivateAlbumAccessKeyUpdateInput = z.infer<typeof privateAlbumAccessKeyUpdateSchema>;
