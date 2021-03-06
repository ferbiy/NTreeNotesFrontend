import {Component, OnDestroy, OnInit} from '@angular/core';
import {fromTopAnimation} from '../../../animations';
import {StoreService} from '../../../services/store.service';
import {ActionService} from '../../../services/action.service';
import {animate, query, stagger, style, transition, trigger} from '@angular/animations';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {debounceTime, distinctUntilChanged, map, switchMap, takeUntil} from 'rxjs/operators';
import {Observable, Subject} from 'rxjs';
import {CrudService} from '../../../services/crud.service';
import {NzMessageService} from 'ng-zorro-antd';
import {queryParamsPack, queryParamsUnpack} from 'src/utils/params'
import {ItemType, NoteModel} from '../../../models/note.model';
import {toArray, truncateForHtml} from '../../../../utils/utils1';
import {TagsService} from '../../../services/tags.service';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.css'],
  providers: [],
  animations: [fromTopAnimation,
    trigger('tagAnimation', [
      transition('void => *', [
        query('div', style({transform: 'translatex(-100%)'})),
        query('div',
          stagger('15ms', [
            animate('220ms', style({transform: 'translateX(0)'}))
          ])
        )
      ])
    ]),
    trigger('noteAnimation', [
      transition('void => *', [
        query('div', style({transform: 'translatex(-100%)'})),
        query('div',
          stagger('10ms', [
            animate('250ms ease-in', style({transform: 'translateX(0)'}))
          ])
        )
      ])
    ])
  ]
})
export class NotesComponent implements OnInit, OnDestroy {

  public tags$: Observable<object[]>;
  public searchTags: string[] = [];
  public excludedTags: string[] = [];
  public notesSearchString: string;
  public items: NoteModel[];
  public listType: ItemType;

  private unsubscribe$ = new Subject<void>();
  private searchNoteDecouncer$: Subject<string> = new Subject();

  constructor(
    public store: StoreService,
    public actionService: ActionService,
    private router: Router,
    private route: ActivatedRoute,
    public crudService: CrudService,
    private messageService: NzMessageService,
    private tagsService: TagsService,
  ) {
  }

  public getMoreNotesData() {
    if (this.store.data.notes.downloadMore) {
      this.actionService.getNotes(this.searchTags, this.notesSearchString, {excludeTags: this.excludedTags})
        .pipe(takeUntil(this.unsubscribe$))
        .subscribe((notes: NoteModel[]) => this.items = this.items.concat(notes));
    }
  }

  public ngOnInit(): void {
    this.crudService.getItemType().pipe(
      switchMap((itemType: ItemType) => {
        this.listType = itemType;
        return this.route.queryParams;
      }),
      switchMap((params: Params) => this.getItems(params)),
      takeUntil(this.unsubscribe$)
    ).subscribe((notes: NoteModel[]) => this.items = notes);
    this.setupSearchNotesDebouncer();
  }

  public ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  public onSearchNoteInputChange(term: string): void {
    this.searchNoteDecouncer$.next(term);
  }

  private async setupSearchNotesDebouncer() {
    this.searchNoteDecouncer$.pipe(
      debounceTime(700),
      distinctUntilChanged()
    ).subscribe(async (term: string) => {
      this.notesSearchString = term;
      await this.refresh_url_search();
    });
  }

  public addNote(): void {
    const queryParams = queryParamsPack({tags: this.searchTags, search: this.notesSearchString, exclude: this.excludedTags});
    this.router.navigate(['/note'], {queryParams});
  }

  async filterNotesTag(tags: string[], include: boolean) {
    include ? this.searchTags = tags : this.excludedTags = tags;
    await this.refresh_url_search();
  }

  NoteSelect(id) {
    this.store.data.note.lastUpdatedId = '';
    this.router.navigate(['/note/' + id]);
  }

  public deleteItem(id: string, event) {
    event.stopPropagation();
    const r = confirm('Данный элемент будет удален! Вы уверены?');
    if (r) {
      this.crudService.deleteItem(id).pipe(
        switchMap(() => this.route.queryParams),
        takeUntil(this.unsubscribe$)
      ).subscribe(() => {
        const deletedItem = this.items.findIndex((note: NoteModel) => note.id === id);
        this.items.splice(deletedItem, 1);
        if (this.listType === ItemType.tag) {
          this.tagsService.deleteTag(id);
        }
      });
    }
  }

  // Обновить роут при фильтрации и запросах
  async refresh_url_search() {
    const queryParams = queryParamsPack({tags: this.searchTags, search: this.notesSearchString, exclude: this.excludedTags});
    return this.router.navigate(['/notes'], {queryParams});
  }

  private getItems(urlParams: Params): Observable<NoteModel[]> {
    const params = queryParamsUnpack(urlParams);
    this.notesSearchString = params.search || '';
    this.searchTags = params.tags || [];
    this.excludedTags = params.exclude || [];
    return this.actionService.getNotes(params.tags, params.search, {refresh: true, excludeTags: params.exclude}).pipe(
      map((notes: NoteModel[]) => {
        return notes.map((note: NoteModel) => {
          let urlHtml = '';
          if (note.url) {
            const s1 = toArray(note.url).map((url1) => `<a href=${url1}>${truncateForHtml(url1, 50)}</a>`).join(', ');
            urlHtml = '  (' + s1 + ')';
          }
          return {...note, urlHtml};
        })
      })
    );
  }
}
