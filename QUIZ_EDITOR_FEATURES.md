# Quiz Editor Feature Documentation

## Overview
The Quiz Editor is a comprehensive interface for creating, editing, and managing interactive quizzes with AI-powered enhancement capabilities.

## Core Features

### 1. Quiz Management
- **Create Quiz**: Start new quiz from scratch
- **Edit Quiz**: Modify existing quiz content
- **Save Quiz**: Save changes to database
- **Delete Quiz**: Remove quiz permanently

### 2. Question Types
- **Multiple Choice (MCQ)**: Standard multiple choice questions
- **Learn Mode**: Read-only content for learning
- **Case Study**: Content with embedded questions
- **Short Answer**: Text-based responses
- **Ordering**: Sequence arrangement questions
- **Flashcard**: True/False cards

### 3. Question Navigation
- **Pagination**: One question visible at a time
- **Navigation Arrows**: ← Previous / Next →
- **Question Numbers**: Direct jump to specific question
- **Highlight Current Question**: Visual indication of active question

### 4. AI Enhancement Tools

#### 4.1 Quiz Analysis
- **Analyze Button**: AI analyzes entire quiz
- **Similarity Detection**: Find redundant questions
- **Quality Assessment**: Evaluate question effectiveness
- **Improvement Suggestions**: AI-generated enhancements
- **Bulk Improvement**: Regenerate all questions

#### 4.2 Translation & Enhancement
- **Translate Button**: Convert questions to different languages
- **Language Support**: 🇹🇭 Thai, 🇬🇧 English, 🇨🇳 Chinese, 🇯🇵 Japanese
- **Enhance Mode**: Improve question quality (Typhoon model)
- **Per-Question AI**: ✨ Magic button for individual questions

#### 4.3 AI Models
- **Gemini Flash**: Fast analysis
- **Gemini Pro**: Detailed analysis
- **GPT-4o**: OpenAI model
- **Claude Sonnet 4.6**: Advanced reasoning
- **Llama 3.3**: Open source model
- **Typhoon**: Thai language enhancement

### 5. Quiz Settings

#### 5.1 Basic Information
- **Title**: Full quiz name
- **Short Title**: Abbreviated name
- **Points**: Total score value
- **Description**: Quiz overview

#### 5.2 Scheduling
- **Start Time**: Quiz availability start
- **Deadline**: Submission deadline
- **Timer Mode**: Per question or total time
- **Time Limits**: Seconds per question or total duration

#### 5.3 Advanced Options
- **Target Groups**: Assign to specific user groups
- **Shuffle Options**: Randomize answer order
- **One-Time Mode**: Single attempt only
- **Homework Mode**: Assignment type
- **Feedback Limit**: Restrict answer viewing

### 6. Question Editor Features

#### 6.1 Question Components
- **Question Text**: Main prompt
- **Answer Options**: Multiple choice answers
- **Correct Answers**: Mark correct responses
- **Timer**: Individual question time limit
- **Question Type**: MCQ, Short Answer, Ordering, Flashcard

#### 6.2 Question Actions
- **Add Option**: Insert new answer choice
- **Remove Option**: Delete answer choice
- **Copy Question**: Duplicate current question
- **Clone Question**: Copy with modifications
- **Delete Question**: Remove from quiz

#### 6.3 Question Navigation
- **Previous/Next**: Arrow navigation
- **Question Numbers**: Direct access
- **Auto-Save**: Automatic draft saving
- **Save Status**: Visual saving indicator

### 7. Import & Export
- **PDF Import**: Convert PDF to quiz questions
- **Quiz Import**: Copy from existing quiz
- **Question Templates**: Reusable question formats

### 8. Visual Design
- **Responsive Layout**: Mobile-friendly interface
- **Highlight System**: Active question emphasis
- **Gradient Buttons**: Modern button styling
- **Glass Toggle**: Smooth UI transitions
- **Color Coding**: Visual type indicators

### 9. Keyboard Shortcuts
- **Escape**: Close modals
- **Tab**: Navigate form fields
- **Enter**: Confirm actions

### 10. Data Management
- **Auto-Save**: Prevent data loss
- **Draft Recovery**: Restore unsaved work
- **Version Control**: Track changes
- **Validation**: Input verification

## Technical Implementation

### HTML Structure
```html
<div id="quizManageModal" class="modal">
  <div class="modal-content responsive-modal">
    <!-- Header -->
    <!-- Toolbar -->
    <!-- Questions Container -->
    <!-- Footer with Save Button -->
  </div>
</div>
```

### Key Functions
- `saveQuiz()`: Save quiz to database
- `updateQuizPagination()`: Handle navigation
- `moveQuizQ(direction)`: Navigate questions
- `aiEnhanceQuestion(btn)`: AI enhancement per question
- `analyzeQuizAI()`: Analyze entire quiz
- `addQuestionUI(data)`: Add new question

### CSS Classes
- `.quiz-q-item`: Question container
- `.magic-btn`: Primary action buttons
- `.glass-toggle-container`: Model/language selectors
- `.active`: Current question indicator

## Usage Workflow

1. **Open Quiz Editor**: Click "Create Quiz" or edit existing
2. **Set Basic Info**: Title, points, description
3. **Add Questions**: Use "Add Question" button
4. **Configure Questions**: Set type, options, timer
5. **AI Enhancement**: Use Analyze/Translate tools
6. **Review**: Navigate through all questions
7. **Save**: Click "Save Quiz" button

## Troubleshooting

### Common Issues
- **Save Button Missing**: Check modal footer
- **Navigation Not Working**: Verify `moveQuizQ()` function
- **AI Translation Fails**: Check API keys and model selection
- **Highlight Missing**: Verify `updateQuizPagination()` styling

### Debug Tools
- **Console Logs**: AI model responses shown
- **Network Tab**: API request monitoring
- **Local Storage**: Draft recovery data

## Future Enhancements
- **Question Banks**: Reusable question library
- **Collaboration**: Multi-user editing
- **Analytics**: Quiz performance metrics
- **Templates**: Pre-built quiz structures
- **Bulk Operations**: Mass question editing

---

*Last Updated: V88.73 - 2026-04-05*
