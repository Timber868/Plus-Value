import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClubPickerComponent, clubColor, clubInitials } from './club-picker.component';

describe('ClubPickerComponent', () => {
  let fixture: ComponentFixture<ClubPickerComponent>;
  const clubs = [
    { id: 'ol', name: 'Olympique Lyonnais', logoUrl: '/crests/1041.png' },
    { id: 'asm', name: 'AS Monaco', logoUrl: null }
  ];

  beforeEach(() => {
    fixture = TestBed.createComponent(ClubPickerComponent);
    fixture.componentRef.setInput('clubs', clubs);
    fixture.componentRef.setInput('selected', 'ol');
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;

  it('shows the selected club with its crest, and initials for a club without one', () => {
    expect(el().querySelector('.trigger img')?.getAttribute('src')).toBe('/crests/1041.png');
    expect(el().querySelector('.trigger .name')?.textContent).toBe('Olympique Lyonnais');

    (el().querySelector('.trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const options = el().querySelectorAll('li');
    expect(options.length).toBe(2);
    expect(options[1].querySelector('.badge')?.textContent).toBe('M');
  });

  it('emits the chosen club with the mouse or the keyboard, and closes', () => {
    const chosen: string[] = [];
    fixture.componentInstance.selectedChange.subscribe((id) => chosen.push(id));
    const trigger = el().querySelector('.trigger') as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();
    (el().querySelectorAll('li')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(chosen).toEqual(['asm']);
    expect(el().querySelector('ul')).toBeNull();

    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(chosen).toEqual(['asm', 'asm']);
  });

  it('falls back to initials when a crest fails to load', () => {
    el().querySelector('.trigger img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el().querySelector('.trigger img')).toBeNull();
    expect(el().querySelector('.trigger .badge')?.textContent).toBe('OL');
  });
});

describe('club badge helpers', () => {
  it('builds initials without generic words and a stable colour', () => {
    expect(clubInitials('Olympique de Marseille')).toBe('OM');
    expect(clubInitials('AS Monaco')).toBe('M');
    expect(clubInitials('Paris Saint-Germain')).toBe('PS');
    expect(clubColor('OGC Nice')).toBe(clubColor('OGC Nice'));
  });
});
