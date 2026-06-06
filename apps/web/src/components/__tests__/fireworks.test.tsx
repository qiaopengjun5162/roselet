import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Fireworks } from "../fireworks";
import { burstFireworks, getFireworkLaunches } from "@/lib/recommend";

jest.mock("@/lib/recommend", () => ({
  burstFireworks: jest.fn(),
  getFireworkLaunches: jest.fn(),
}));

describe("Fireworks", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("launches particles and removes them after animation", async () => {
    (getFireworkLaunches as jest.Mock).mockResolvedValue([
      { cx: 50, cy: 40, count: 1, delay_ms: 10 },
    ]);
    (burstFireworks as jest.Mock).mockResolvedValue([
      {
        id: 1,
        x: 50,
        y: 40,
        color: "#fff",
        tx: 10,
        ty: -20,
        size: 4,
        delay: 0.1,
        duration: 0.8,
      },
    ]);

    const { container } = render(<Fireworks />);
    expect(container.firstChild).toBeNull();

    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(10);
    });
    await act(async () => {});

    expect(burstFireworks).toHaveBeenCalledWith(50, 40, 1, 0);
    const particle = container.querySelector(".absolute.rounded-full") as HTMLElement;
    expect(particle).toBeInTheDocument();
    expect(particle.style.left).toBe("50%");
    expect(particle.style.top).toBe("40%");

    await act(async () => {
      jest.advanceTimersByTime(1800);
    });

    expect(screen.queryByText("#fff")).not.toBeInTheDocument();
    expect(container.querySelector(".absolute.rounded-full")).toBeNull();
  });

  it("does not set particles after unmount", async () => {
    (getFireworkLaunches as jest.Mock).mockResolvedValue([
      { cx: 50, cy: 40, count: 1, delay_ms: 10 },
    ]);

    const { unmount } = render(<Fireworks />);
    unmount();

    await act(async () => {});
    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(burstFireworks).not.toHaveBeenCalled();
  });
});
