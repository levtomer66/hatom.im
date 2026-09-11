import React from 'react';

export default function NotepadFrame({
  title = 'Things To Do',
  mini = false,
  children,
}: {
  title?: React.ReactNode;
  mini?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`todo-notepad ${mini ? 'todo-notepad--mini' : ''}`}>
      <div className="todo-stripe todo-stripe--top" aria-hidden />
      <div className="todo-notepad-body">
        <div className="todo-chevron-col todo-chevron-col--left" aria-hidden />
        <div className="todo-notepad-content">
          <div className="todo-notepad-header">
            <span className="todo-title-chevrons" aria-hidden>»»»</span>
            <h1 className="todo-notepad-title">{title}</h1>
            <span className="todo-title-chevrons" aria-hidden>«««</span>
          </div>
          {children}
        </div>
        <div className="todo-chevron-col todo-chevron-col--right" aria-hidden />
      </div>
      <div className="todo-stripe todo-stripe--bottom" aria-hidden />
    </div>
  );
}
