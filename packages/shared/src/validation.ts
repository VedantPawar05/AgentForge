import { z } from "zod";
import {
  WorkspaceRole,
  TaskPriority,
  TaskStatus,
  ApprovalStatus,
} from "./enums.js";

// Base ID schema (UUID v4 or v7)
export const uuidSchema = z.string().uuid({ message: "Must be a valid UUID" });

// Pagination Query Schema
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Workspace Schemas
export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .trim()
    .regex(/^[a-z0-9-]+$/, {
      message: "Slug can only contain lowercase letters, numbers, and hyphens",
    }),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
});

// Membership & Invitation Schemas
export const inviteMemberSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum([
    WorkspaceRole.ADMIN,
    WorkspaceRole.DEVELOPER,
    WorkspaceRole.REVIEWER,
  ]),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum([
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.DEVELOPER,
    WorkspaceRole.REVIEWER,
  ]),
});

// Project Schemas
export const createProjectSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  repoOwner: z.string().min(1).max(100).trim(),
  repoName: z.string().min(1).max(100).trim(),
  defaultBranch: z.string().min(1).max(100).trim().default("main"),
  testCommand: z.string().max(500).trim().optional().default("npm test"),
  buildCommand: z.string().max(500).trim().optional().default("npm run build"),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  defaultBranch: z.string().min(1).max(100).trim().optional(),
  testCommand: z.string().max(500).trim().optional(),
  buildCommand: z.string().max(500).trim().optional(),
});

// Task Schemas
export const createTaskSchema = z.object({
  title: z.string().min(3).max(250).trim(),
  description: z.string().max(10000).trim().optional().default(""),
  priority: z.nativeEnum(TaskPriority).optional().default(TaskPriority.MEDIUM),
  targetBranch: z.string().min(1).max(100).trim().optional().default("main"),
  dependencyTaskIds: z.array(uuidSchema).optional().default([]),
});

export const updateTaskSchema = z.object({
  title: z.string().min(3).max(250).trim().optional(),
  description: z.string().max(10000).trim().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  version: z
    .number()
    .int()
    .positive({ message: "Version is required for optimistic concurrency" }),
});

export const taskQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  search: z.string().max(100).optional(),
});

// Run Schemas
export const triggerRunSchema = z.object({
  maxExecutionSeconds: z
    .number()
    .int()
    .min(30)
    .max(3600)
    .optional()
    .default(600),
});

// Approval Schemas
export const submitApprovalSchema = z.object({
  decision: z.enum([
    ApprovalStatus.APPROVED,
    ApprovalStatus.CHANGES_REQUESTED,
    ApprovalStatus.REJECTED,
  ]),
  notes: z.string().max(5000).trim().optional().default(""),
});

// Merge Request Schema
export const triggerMergeSchema = z.object({
  commitMessage: z.string().min(5).max(500).trim().optional(),
});
