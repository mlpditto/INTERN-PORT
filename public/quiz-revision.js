// Preserve question order and scoring for attempts made before curation.
window.quizForAttempt = function (quiz, attempt, quizzes) {
    if (!attempt?.quizRevisionId) return quiz;
    const revision = quizzes.find(q => q.id === attempt.quizRevisionId);
    if (!revision) throw new Error('The original question version is unavailable. Refresh before reviewing this attempt.');
    return { ...revision, quizRevisionId: attempt.quizRevisionId, id: quiz?.id || attempt.quizId, title: quiz?.title || revision.title,
        isActive: quiz?.isActive, startTime: quiz?.startTime, deadline: quiz?.deadline };
};
