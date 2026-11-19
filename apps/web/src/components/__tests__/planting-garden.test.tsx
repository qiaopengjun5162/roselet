import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlantingGarden } from "../planting-garden";

describe("PlantingGarden（初心第三界面的种进花圃动画）", () => {
  it("显示初心感谢文案", () => {
    render(<PlantingGarden color="red" />);
    expect(screen.getByText("谢谢你在社区种下的玫瑰")).toBeInTheDocument();
  });

  it("花圃里有各色玫瑰，包含刚种下的那朵", () => {
    render(<PlantingGarden color="yellow" />);
    // 4 朵（邻居白红黄 + 刚种下的黄），每朵都有 rose-bloom
    expect(screen.getAllByTestId("rose-bloom").length).toBe(4);
  });
});
