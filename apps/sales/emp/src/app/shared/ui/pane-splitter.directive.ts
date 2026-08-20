import { Directive, ElementRef, Input, OnInit, OnDestroy, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appPaneSplitter]',
  standalone: true
})
export class PaneSplitterDirective implements OnInit, OnDestroy {
  @Input() storageKey = 'emp_pane_splitter_width';
  @Input() minWidth = 260;
  @Input() defaultWidth = 380;

  private resizerEl?: HTMLElement;
  private unlistenMouseDown?: () => void;
  private unlistenMouseMove?: () => void;
  private unlistenMouseUp?: () => void;
  private unlistenTouchStart?: () => void;
  private unlistenTouchMove?: () => void;
  private unlistenTouchEnd?: () => void;
  private isDragging = false;
  private startX = 0;
  private startWidth = 0;

  constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2) {}

  ngOnInit(): void {
    const container = this.el.nativeElement;
    const leftPane = container.children[0] as HTMLElement;
    if (!leftPane) return;

    // Load saved width
    let initialWidth = this.defaultWidth;
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= this.minWidth) {
          initialWidth = parsed;
        }
      }
    } catch {}

    this.applyWidth(leftPane, initialWidth);

    // Create or find resizer element
    let resizer = container.querySelector('.invoice-pane-resizer') as HTMLElement;
    if (!resizer) {
      resizer = this.renderer.createElement('div');
      this.renderer.addClass(resizer, 'invoice-pane-resizer');
      resizer.setAttribute('title', 'Drag to resize column');
      if (container.children.length > 1) {
        this.renderer.insertBefore(container, resizer, container.children[1]);
      } else {
        this.renderer.appendChild(container, resizer);
      }
    }
    this.resizerEl = resizer;

    this.unlistenMouseDown = this.renderer.listen(resizer, 'mousedown', (e: MouseEvent) => this.onDragStart(e));
    this.unlistenTouchStart = this.renderer.listen(resizer, 'touchstart', (e: TouchEvent) => this.onDragStart(e));
  }

  private applyWidth(leftPane: HTMLElement, width: number): void {
    leftPane.style.setProperty('width', `${width}px`, 'important');
    leftPane.style.setProperty('flex', `0 0 ${width}px`, 'important');
    leftPane.style.setProperty('max-width', '80%', 'important');
    leftPane.style.setProperty('min-width', `${this.minWidth}px`, 'important');
  }

  private onDragStart(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    this.startX = clientX;
    const container = this.el.nativeElement;
    const leftPane = container.children[0] as HTMLElement;
    this.startWidth = leftPane.getBoundingClientRect().width;

    if (this.resizerEl) {
      this.renderer.addClass(this.resizerEl, 'is-resizing');
    }
    this.renderer.addClass(document.body, 'is-column-resizing');

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!this.isDragging) return;
      const currentX = 'touches' in moveEvent ? (moveEvent as TouchEvent).touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const dx = currentX - this.startX;
      const containerWidth = container.getBoundingClientRect().width;
      const maxAllowed = Math.max(this.minWidth, containerWidth - 280);
      const newWidth = Math.min(Math.max(this.minWidth, this.startWidth + dx), maxAllowed);
      this.applyWidth(leftPane, newWidth);
      
      try {
        localStorage.setItem(this.storageKey, Math.round(newWidth).toString());
      } catch {}
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.resizerEl) {
        this.renderer.removeClass(this.resizerEl, 'is-resizing');
      }
      this.renderer.removeClass(document.body, 'is-column-resizing');

      const finalWidth = leftPane.getBoundingClientRect().width || leftPane.offsetWidth;
      if (finalWidth > 0) {
        try {
          localStorage.setItem(this.storageKey, Math.round(finalWidth).toString());
        } catch {}
      }

      if (this.unlistenMouseMove) {
        this.unlistenMouseMove();
        this.unlistenMouseMove = undefined;
      }
      if (this.unlistenMouseUp) {
        this.unlistenMouseUp();
        this.unlistenMouseUp = undefined;
      }
      if (this.unlistenTouchMove) {
        this.unlistenTouchMove();
        this.unlistenTouchMove = undefined;
      }
      if (this.unlistenTouchEnd) {
        this.unlistenTouchEnd();
        this.unlistenTouchEnd = undefined;
      }
    };

    this.unlistenMouseMove = this.renderer.listen('window', 'mousemove', onMove);
    this.unlistenMouseUp = this.renderer.listen('window', 'mouseup', onEnd);
    this.unlistenTouchMove = this.renderer.listen('window', 'touchmove', onMove);
    this.unlistenTouchEnd = this.renderer.listen('window', 'touchend', onEnd);
  }

  ngOnDestroy(): void {
    if (this.unlistenMouseDown) this.unlistenMouseDown();
    if (this.unlistenTouchStart) this.unlistenTouchStart();
    if (this.unlistenMouseMove) this.unlistenMouseMove();
    if (this.unlistenMouseUp) this.unlistenMouseUp();
    if (this.unlistenTouchMove) this.unlistenTouchMove();
    if (this.unlistenTouchEnd) this.unlistenTouchEnd();
  }
}
