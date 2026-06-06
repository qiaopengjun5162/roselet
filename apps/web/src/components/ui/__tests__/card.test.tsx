import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card";

describe("Card", () => {
  it("renders all card slots with custom classes", () => {
    render(
      <Card size="sm" className="outer">
        <CardHeader className="header">
          <CardTitle className="title">Title</CardTitle>
          <CardDescription className="description">Description</CardDescription>
          <CardAction className="action">Action</CardAction>
        </CardHeader>
        <CardContent className="content">Content</CardContent>
        <CardFooter className="footer">Footer</CardFooter>
      </Card>
    );

    expect(screen.getByText("Title").closest("[data-slot='card-title']")).toHaveClass("title");
    expect(screen.getByText("Description").closest("[data-slot='card-description']")).toHaveClass("description");
    expect(screen.getByText("Action").closest("[data-slot='card-action']")).toHaveClass("action");
    expect(screen.getByText("Content").closest("[data-slot='card-content']")).toHaveClass("content");
    expect(screen.getByText("Footer").closest("[data-slot='card-footer']")).toHaveClass("footer");
  });
});
