import { TestBed } from '@angular/core/testing';

import { MoneyToggleComponent } from './money-toggle.component';

describe('MoneyToggleComponent', () => {
  it('switches between current and constant euros and explains the choice', () => {
    const fixture = TestBed.createComponent(MoneyToggleComponent);
    fixture.componentRef.setInput('referenceYear', 2025);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [current, constant] = Array.from(el.querySelectorAll('button'));

    expect(current.getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain("sans tenir compte de l'inflation");

    constant.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.constant()).toBeTrue();
    expect(constant.getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('Euros constants de 2025');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('convertis en euros de 2025');
  });
});
