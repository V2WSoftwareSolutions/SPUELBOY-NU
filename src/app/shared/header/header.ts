import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';

/**
 * Landing-page header: the SPÜLBOY® lock-up, the section links, the quote CTA
 * and — below 1024px — the menu they collapse into. Everything is an in-page
 * anchor; this storefront is a single page by design.
 */
@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly menuOpen = signal(false);

  protected readonly links = [
    { href: '#top', label: 'Home' },
    { href: '#nu-portable', label: 'NU® Portable' },
    { href: '#nu-built-in', label: 'NU® Built-in' },
    { href: '#neptun-t2000', label: 'Neptun T2000' },
    { href: '#contact', label: 'Contact' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeAll(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closeAll();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.closeAll();
  }
}
