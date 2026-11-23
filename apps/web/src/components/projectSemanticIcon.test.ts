import { describe, expect, it } from "vite-plus/test";
import {
  CpuIcon,
  FileTextIcon,
  FolderIcon,
  LaptopIcon,
  MessageSquareIcon,
  WorkflowIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { projectSemanticIcon, StarburstLineIcon } from "./projectSemanticIcon";

describe("projectSemanticIcon", () => {
  it("maps the sidebar categories to line icons by meaning", () => {
    expect(projectSemanticIcon("其他工具")).toBe(WrenchIcon);
    expect(projectSemanticIcon("T3 功能与维护")).toBe(StarburstLineIcon);
    expect(projectSemanticIcon("模型与账号")).toBe(CpuIcon);
    expect(projectSemanticIcon("自动化与知识库")).toBe(WorkflowIcon);
    expect(projectSemanticIcon("电脑与设备")).toBe(LaptopIcon);
    expect(projectSemanticIcon("其他内容")).toBe(FileTextIcon);
    expect(projectSemanticIcon("公众号")).toBe(MessageSquareIcon);
    expect(projectSemanticIcon("X")).toBe(XIcon);
  });

  it("falls back to a folder for names it cannot place", () => {
    expect(projectSemanticIcon("杂项")).toBe(FolderIcon);
    expect(projectSemanticIcon("Xylophone")).toBe(FolderIcon);
  });
});
