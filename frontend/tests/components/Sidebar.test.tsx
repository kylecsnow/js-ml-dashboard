import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import Sidebar from '../../app/components/Sidebar';

const navState = vi.hoisted(() => ({ pathname: '/overview' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const hidden = { hidden: true } as const;

function nav() {
  return screen.getByRole('navigation', { name: 'Sidebar', ...hidden });
}

describe('Sidebar', () => {
  beforeEach(() => {
    navState.pathname = '/overview';
    localStorage.clear();
  });

  it('renders Home, then ML Dashboard, then Bonus', () => {
    render(<Sidebar />);

    const sidebar = nav();
    const labels = within(sidebar)
      .getAllByRole('link', hidden)
      .map((link) => link.textContent?.replace(/\s+/g, ' ').trim());

    expect(labels[0]).toBe('Home');
    expect(labels[1]).toBe('About Me');
    expect(labels.slice(2, 8)).toEqual([
      'Overview',
      'Violin Plots',
      'Scatter Plots',
      'Correlation Heatmaps',
      'SHAP Summary Plots',
      'SHAP Waterfall Plots',
    ]);
    expect(labels.slice(8)).toEqual([
      'Molecular Design',
      'Dataset Generator',
      'Object Detection',
    ]);

    const sectionButtons = within(sidebar).getAllByRole('button', hidden)
      .filter((button) => button.getAttribute('aria-controls')?.startsWith('sidebar-section-'));
    expect(sectionButtons.map((button) => button.textContent?.trim())).toEqual([
      'ML Dashboard',
      'Bonus',
    ]);
  });

  it('collapses and expands a section', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    const bonusToggle = screen.getByRole('button', { name: 'Bonus', ...hidden });
    expect(screen.getByRole('link', { name: /Molecular Design/, ...hidden })).toBeInTheDocument();

    await user.click(bonusToggle);
    expect(screen.queryByRole('link', { name: /Molecular Design/, ...hidden })).not.toBeInTheDocument();
    expect(bonusToggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(bonusToggle);
    expect(screen.getByRole('link', { name: /Molecular Design/, ...hidden })).toBeInTheDocument();
    expect(bonusToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('marks About Me as selected on variant routes', () => {
    navState.pathname = '/about-me/spine';
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: /About Me/, ...hidden }).className).toContain('bg-black');
    expect(screen.getByRole('link', { name: /Home/, ...hidden }).className).not.toContain('bg-black');
  });

  it('marks the current page as selected', () => {
    navState.pathname = '/dataset-generator';
    render(<Sidebar />);

    const current = screen.getByRole('link', { name: /Dataset Generator/, ...hidden });
    expect(current.className).toContain('bg-black');
    expect(screen.getByRole('link', { name: /Home/, ...hidden }).className).not.toContain('bg-black');
  });

  it('opens and closes the mobile drawer', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    const openButton = screen.getByRole('button', { name: 'Open sidebar' });
    expect(openButton.className).toContain('sm:hidden');

    await user.click(openButton);
    expect(screen.queryByRole('button', { name: 'Open sidebar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss sidebar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close sidebar' }));
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close sidebar' })).not.toBeInTheDocument();
  });

  it('still offers a mobile open control after the sidebar was collapsed', async () => {
    localStorage.setItem('sidebarCollapsed', 'true');
    render(<Sidebar />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
  });

  it('closes the mobile drawer after navigation', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'Open sidebar' }));
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeInTheDocument();

    navState.pathname = '/violin-plots';
    rerender(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Open sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close sidebar' })).not.toBeInTheDocument();
  });
});
