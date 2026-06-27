import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let mockSinarms = null;

vi.mock('../context/SinarmsContext', () => ({
  useSinarms: () => mockSinarms,
}));

import AIChatbot from '../components/visitor/AIChatbot';

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  mockSinarms = {
    sendChatbotQuery: vi.fn().mockResolvedValue({ answer: 'hi' }),
    rerouteVisitor: vi.fn(),
    currentVisitor: { id: 'v1' },
  };
});

describe('debug', () => {
  it('keydown with full props', () => {
    render(<AIChatbot organizationId="o" locationId="l" />);
    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.input(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });
    console.log('FULLKEY -> SEND CALLS:', mockSinarms.sendChatbotQuery.mock.calls.length);
  });

  it('input event + send button click', () => {
    render(<AIChatbot organizationId="o" locationId="l" />);
    fireEvent.click(screen.getByRole('button', { name: /open ai assistant/i }));
    const input = screen.getByPlaceholderText(/ask a question/i);
    fireEvent.input(input, { target: { value: 'hello' } });
    const buttons = document.querySelectorAll('button');
    const sendBtn = buttons[buttons.length - 1];
    fireEvent.click(sendBtn);
    console.log('INPUT+CLICK -> SEND CALLS:', mockSinarms.sendChatbotQuery.mock.calls.length, 'value now:', input.value);
  });
});
