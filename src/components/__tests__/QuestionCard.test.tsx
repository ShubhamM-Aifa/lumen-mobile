import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QuestionCard } from '../QuestionCard';
import { IQuestion, IOption, Answer } from '@lumen/shared';

jest.mock('react-native/Libraries/LayoutAnimation/LayoutAnimation', () => ({
  Presets: { easeInEaseOut: {} },
  configureNext: jest.fn(),
}));

function makeQuestion(overrides: Partial<IQuestion> = {}): IQuestion {
  return {
    _id: 'q1',
    userId: 'u1',
    categoryId: 'cat1',
    title: 'How do you feel?',
    selectionType: 'single',
    allowOther: false,
    required: false,
    frequency: 'anytime',
    order: 0,
    version: 1,
    isActive: true,
    ...overrides,
  } as IQuestion;
}

function makeOption(id: string, label: string): IOption {
  return {
    _id: id,
    userId: 'u1',
    questionId: 'q1',
    label,
    fields: [],
    allowComment: false,
    captureTime: 'none',
    order: 0,
    isActive: true,
  } as unknown as IOption;
}

describe('QuestionCard', () => {
  const options = [makeOption('o1', 'Good'), makeOption('o2', 'Bad')];

  it('renders the question title', () => {
    render(
      <QuestionCard
        question={makeQuestion()}
        options={options}
        answers={[]}
        sessionAnswers={[]}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('How do you feel?')).toBeTruthy();
  });

  it('is hidden when conditionalDisplay requires an absent optionId', () => {
    const question = makeQuestion({
      conditionalDisplay: { requiredOptionId: 'must-have-this' },
    });
    const { queryByText } = render(
      <QuestionCard
        question={question}
        options={options}
        answers={[]}
        sessionAnswers={[]} // does NOT contain 'must-have-this'
        onChange={jest.fn()}
      />
    );
    expect(queryByText('How do you feel?')).toBeNull();
  });

  it('is visible when conditionalDisplay required optionId is present in sessionAnswers', () => {
    const question = makeQuestion({
      conditionalDisplay: { requiredOptionId: 'must-have-this' },
    });
    const sessionAnswers: Answer[] = [
      { optionId: 'must-have-this', optionLabelSnapshot: 'Yes', values: [] },
    ];
    render(
      <QuestionCard
        question={question}
        options={options}
        answers={[]}
        sessionAnswers={sessionAnswers}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('How do you feel?')).toBeTruthy();
  });

  it('calls onChange when an option is selected', () => {
    const onChange = jest.fn();
    render(
      <QuestionCard
        question={makeQuestion()}
        options={options}
        answers={[]}
        sessionAnswers={[]}
        onChange={onChange}
      />
    );
    fireEvent.press(screen.getByText('Good'));
    expect(onChange).toHaveBeenCalled();
  });

  it('shows helpText when provided', () => {
    render(
      <QuestionCard
        question={makeQuestion({ helpText: 'Rate how you feel today' })}
        options={options}
        answers={[]}
        sessionAnswers={[]}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByText('Rate how you feel today')).toBeTruthy();
  });

  it('can be collapsed and expanded by tapping the header', () => {
    render(
      <QuestionCard
        question={makeQuestion()}
        options={options}
        answers={[{ optionId: 'o1', optionLabelSnapshot: 'Good', values: [] }]}
        sessionAnswers={[]}
        onChange={jest.fn()}
      />
    );

    // Initially expanded: options are visible
    expect(screen.getByText('Good')).toBeTruthy();

    // Tap header to collapse
    fireEvent.press(screen.getByLabelText('Collapse How do you feel?'));

    // Options selector is now hidden in collapsed state
    expect(screen.getByLabelText('Expand How do you feel?')).toBeTruthy();

    // Tap header to expand again
    fireEvent.press(screen.getByLabelText('Expand How do you feel?'));
    expect(screen.getByText('Good')).toBeTruthy();
  });

  it('handles collapsible today history list and detailed option values toggle', () => {
    const todayHistory = [
      {
        logId: 'log-1',
        occurredAt: '2026-10-12T14:00:00Z',
        timeFormatted: '1h ago',
        timeClockStr: '2:00 PM',
        answers: [{ optionId: 'o1', values: [{ fieldKey: 'severity', value: 8, unit: '/10' }] }],
        summaryText: 'Good',
        details: [
          {
            optionId: 'o1',
            optionLabel: 'Good',
            fields: [
              {
                key: 'severity',
                label: 'Severity',
                value: 8,
                displayValue: '8 /10',
                unit: '/10',
              },
            ],
            comment: 'Felt great',
          },
        ],
      },
      {
        logId: 'log-2',
        occurredAt: '2026-10-12T10:00:00Z',
        timeFormatted: '5h ago',
        timeClockStr: '10:00 AM',
        answers: [{ optionId: 'o2', values: [] }],
        summaryText: 'Bad',
        details: [
          {
            optionId: 'o2',
            optionLabel: 'Bad',
            fields: [],
          },
        ],
      },
    ];

    render(
      <QuestionCard
        question={makeQuestion()}
        options={options}
        answers={[]}
        sessionAnswers={[]}
        onChange={jest.fn()}
        todayHistory={todayHistory}
      />
    );

    // Shows 1 entry by default with button to show earlier 1 entry
    expect(screen.getByText('Show earlier 1 entry')).toBeTruthy();

    // Toggle button to expand all history entries
    fireEvent.press(screen.getByText('Show earlier 1 entry'));
    expect(screen.getByText('Show latest entry only')).toBeTruthy();

    // Option values can be toggled via 'See values'
    const seeValuesButtons = screen.getAllByText('See values');
    expect(seeValuesButtons.length).toBeGreaterThan(0);

    fireEvent.press(seeValuesButtons[0]);
    expect(screen.getByText('Hide values')).toBeTruthy();
    expect(screen.getByText('"Felt great"')).toBeTruthy();
  });
});
