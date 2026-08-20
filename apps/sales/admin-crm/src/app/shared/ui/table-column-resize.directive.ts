import { Directive, ElementRef, Input, OnInit, AfterViewInit, OnDestroy, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appTableColumnResize]',
  standalone: true
})
export class TableColumnResizeDirective implements OnInit, AfterViewInit, OnDestroy {
  @Input() storageKey = 'table_col_widths';
  @Input() minColumnWidth = 35;

  private unlistenList: Array<() => void> = [];
  private activeCleanup?: () => void;

  constructor(private el: ElementRef<HTMLTableElement>, private renderer: Renderer2) {}

  ngOnInit(): void {
    const table = this.el.nativeElement;
    table.style.setProperty('table-layout', 'fixed', 'important');
    table.style.setProperty('width', 'max-content', 'important');
    table.style.setProperty('min-width', '100%', 'important');
    table.style.setProperty('border-collapse', 'separate', 'important');
    table.style.setProperty('border-spacing', '0', 'important');
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initColumns();
    }, 50);
  }

  private initColumns(): void {
    const table = this.el.nativeElement;
    const thElements = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    if (thElements.length === 0) return;

    // Load saved widths
    let savedWidths: number[] = [];
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        savedWidths = JSON.parse(saved);
      }
    } catch {}

    thElements.forEach((th, index) => {
      th.style.setProperty('position', 'relative', 'important');
      th.style.setProperty('white-space', 'nowrap', 'important');
      th.style.setProperty('overflow', 'hidden', 'important');
      th.style.setProperty('text-overflow', 'ellipsis', 'important');

      let w = savedWidths[index];
      if (!w || w < this.minColumnWidth) {
        w = Math.max(this.minColumnWidth, Math.round(th.getBoundingClientRect().width || th.offsetWidth || 120));
      }

      th.style.setProperty('width', `${w}px`, 'important');
      th.style.setProperty('min-width', `${w}px`, 'important');
      th.style.setProperty('max-width', `${w}px`, 'important');

      // Check if handle already exists
      let handle = th.querySelector('.col-resize-handle') as HTMLElement;
      if (!handle) {
        handle = this.renderer.createElement('span');
        this.renderer.addClass(handle, 'col-resize-handle');
        handle.setAttribute('title', 'Drag to resize column');
        this.renderer.appendChild(th, handle);
      }

      const unMouseDown = this.renderer.listen(handle, 'mousedown', (e: MouseEvent) => this.onStartResize(e, th));
      const unTouchStart = this.renderer.listen(handle, 'touchstart', (e: TouchEvent) => this.onStartResize(e, th));
      this.unlistenList.push(unMouseDown, unTouchStart);
    });

    table.style.setProperty('table-layout', 'fixed', 'important');
  }

  private onStartResize(e: MouseEvent | TouchEvent, th: HTMLElement): void {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startX = clientX;
    const startWidth = th.getBoundingClientRect().width || th.offsetWidth;

    this.renderer.addClass(document.body, 'is-col-resizing');
    this.renderer.addClass(th, 'is-col-resizing');

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const deltaX = currentX - startX;
      const newWidth = Math.max(this.minColumnWidth, Math.round(startWidth + deltaX));
      th.style.setProperty('width', `${newWidth}px`, 'important');
      th.style.setProperty('min-width', `${newWidth}px`, 'important');
      th.style.setProperty('max-width', `${newWidth}px`, 'important');
    };

    const onEnd = () => {
      this.renderer.removeClass(document.body, 'is-col-resizing');
      this.renderer.removeClass(th, 'is-col-resizing');
      this.saveWidths();

      if (this.activeCleanup) {
        this.activeCleanup();
        this.activeCleanup = undefined;
      }
    };

    const unMouseMove = this.renderer.listen('window', 'mousemove', onMove);
    const unMouseUp = this.renderer.listen('window', 'mouseup', onEnd);
    const unTouchMove = this.renderer.listen('window', 'touchmove', onMove);
    const unTouchEnd = this.renderer.listen('window', 'touchend', onEnd);

    this.activeCleanup = () => {
      unMouseMove();
      unMouseUp();
      unTouchMove();
      unTouchEnd();
    };
  }

  private saveWidths(): void {
    const table = this.el.nativeElement;
    const thElements = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];
    const widths = thElements.map(th => Math.round(th.getBoundingClientRect().width || th.offsetWidth));

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(widths));
    } catch {}
  }

  ngOnDestroy(): void {
    this.unlistenList.forEach(un => un());
    this.unlistenList = [];
    if (this.activeCleanup) {
      this.activeCleanup();
      this.activeCleanup = undefined;
    }
  }
}
