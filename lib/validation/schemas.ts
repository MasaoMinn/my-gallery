import { z } from "zod";

export const albumCreateSchema = z.object({
  title: z.string().trim().min(1, "相册标题不能为空").max(120, "相册标题过长"),
  description: z.string().trim().max(2_000, "相册描述过长").default(""),
  albumType: z.enum(["album", "setting"]).default("album"),
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

export const albumFieldsUpdateSchema = z.object({
  fields: z.array(
    z.object({
      label: z.string().trim().min(1, "字段名称不能为空").max(80, "字段名称过长"),
      value: z.string().trim().max(500, "字段内容过长")
    })
  ).max(50, "基础信息最多包含 50 项")
});

export const imageDuplicateCheckSchema = z.object({
  files: z.array(
    z.object({
      clientId: z.string().min(1).max(100),
      filename: z.string().min(1).max(512),
      sizeBytes: z.number().int().nonnegative(),
      contentType: z.string().min(1).max(200)
    })
  ).min(1)
});

export const adminLoginSchema = z.object({
  token: z.string().trim().min(1, "请输入管理员密钥").max(512, "管理员密钥过长")
});

export type AlbumCreateInput = z.infer<typeof albumCreateSchema>;
export type AlbumUpdateInput = z.infer<typeof albumUpdateSchema>;
export type AlbumFieldsUpdateInput = z.infer<typeof albumFieldsUpdateSchema>;
export type ImageUpdateInput = z.infer<typeof imageUpdateSchema>;
export type ImageUploadMetadataInput = z.infer<typeof imageUploadMetadataSchema>;
