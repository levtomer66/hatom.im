import React from 'react';
import { colorForEmail, initialOf } from './todo-colors';

// Google avatar for a member, falling back to a deterministic coloured initial
// when the user has no stored image (never signed in).
export default function Avatar({
  email,
  name,
  image,
  size = 22,
  title,
}: {
  email: string;
  name: string;
  image?: string;
  size?: number;
  title?: string;
}) {
  const label = title ?? name;
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        title={label}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="todo-avatar"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="todo-avatar todo-avatar--initial"
      title={label}
      style={{ width: size, height: size, background: colorForEmail(email), fontSize: Math.round(size * 0.42) }}
    >
      {initialOf(name)}
    </span>
  );
}
