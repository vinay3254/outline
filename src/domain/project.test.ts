import { describe, it, expect } from 'vitest';
import {
  createProject,
  frameToSeconds,
  secondsToFrame,
  formatTimecode,
} from './project';

describe('Project domain', () => {
  it('converts between frames and seconds accurately', () => {
    expect(frameToSeconds(15, 30)).toBe(0.5);
    expect(secondsToFrame(0.51, 30)).toBe(15);
  });

  it('creates a project with default 30 fps and default tracks', () => {
    const project = createProject('Demo');
    expect(project.name).toBe('Demo');
    expect(project.frameRate).toBe(30);
    expect(project.tracks).toHaveLength(2);
    expect(project.tracks[0]).toEqual({ id: 'v1', name: 'Video 1', type: 'video' });
    expect(project.tracks[1]).toEqual({ id: 'a1', name: 'Audio 1', type: 'audio' });
    expect(project.clips).toEqual([]);
    expect(project.assets).toEqual([]);
    expect(project.id).toBeDefined();
  });

  it('supports custom frame rates upon creation', () => {
    const project = createProject('Cinema', 24);
    expect(project.frameRate).toBe(24);
  });

  it('formats timecode correctly', () => {
    expect(formatTimecode(0, 30)).toBe('00:00:00:00');
    expect(formatTimecode(31, 30)).toBe('00:00:01:01');
    expect(formatTimecode(3661 * 30 + 15, 30)).toBe('01:01:01:15');
  });
});
