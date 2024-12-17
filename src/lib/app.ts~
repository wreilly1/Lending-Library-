import { Errors } from 'cs544-js-utils';

//types defined in library.ts in earlier projects
import * as Lib from 'library-types';


import { NavLinks, LinkedResult, PagedEnvelope, SuccessEnvelope }
  from './response-envelopes.js';

import { makeLibraryWs, LibraryWs } from './library-ws.js';

import { makeElement, makeQueryUrl } from './utils.js';

export default function makeApp(wsUrl: string) {
  return new App(wsUrl);
}


class App {
  private readonly wsUrl: string;
  private readonly ws: LibraryWs;

  private readonly result: HTMLElement;
  private readonly errors: HTMLElement;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
    this.ws = makeLibraryWs(wsUrl);
    this.result = document.querySelector('#result');
    this.errors = document.querySelector('#errors');
    const search = document.querySelector('#search') as HTMLInputElement;
    search.addEventListener('blur',  async ev => {
      this.clearErrors();
      const target = ev.target as HTMLInputElement;
      const search = target.value;
      const url = makeQueryUrl(this.wsUrl + '/api/books', { search });
      await this.searchBooks(url);
    });
  }
  
  private searchBooks = async (url: URL|string) => {
    this.result.innerHTML = '';
    const result = await this.ws.findBooksByUrl(url);
    const pagedResults = this.unwrap(result);
    if (pagedResults) {
      const { result: results, links } = pagedResults;
      this.result.append(this.displayScroll(links));
      this.result.append(this.displaySearchResults(results));
      this.result.append(this.displayScroll(links));
    }
  }

  private displayScroll(links: NavLinks) {
    const scroll = makeElement('div', { class: 'scroll' });
    for (const [rel, text] of [['prev', '<<'], ['next', '>>']]) {
      const href = links[rel as keyof NavLinks]?.href;
      if (href) {
	const a = makeElement('a', { rel }, text);
	a.addEventListener('click', ev => {
	  ev.preventDefault();
	  this.clearErrors();
	  this.searchBooks(href);
	});
	scroll.append(a);
      }
    }
    return scroll;
  }
  
  private displaySearchResults(results: LinkedResult<Lib.XBook>[]) {
    const ul = makeElement('ul', { id: 'search-results' });
    for (const linkedResult of results) {
      const details = makeElement('a', { class: 'details' }, ' details...');
      const title =
	makeElement('span', { class: 'content' }, linkedResult.result.title);
      ul.append(makeElement('li', {}, title, details));
      const href = linkedResult.links.self.href;
      details.addEventListener('click', async (ev) => {
	ev.preventDefault();
	this.clearErrors();
	await this.getBook(href);
      });
    }
    return ul;
  }

  private async getBook(url: string) {
    this.result.innerHTML = '';
    const result = await this.ws.getBookByUrl(url);
    const linkedBook = this.unwrap(result);
    if (linkedBook) {
      const book = linkedBook.result;
      this.result.append(this.displayBook(book));
      await this.updateBorrowers(book.isbn);
      this.result.append(this.checkoutForm(book.isbn));
    }
  }

  private async updateBorrowers(isbn: string) {
    const borrowers = this.result.querySelector('#borrowers');
    console.assert(borrowers !== null);
    const lendsResult = await this.ws.getLends(isbn);
    const lends = this.unwrap(lendsResult);
    if (lends) {
      borrowers.innerHTML = '';
      if (lends.length === 0) {
	borrowers.append('None');
      }
      else {
	const ul = makeElement('ul');
	borrowers.append(ul);
	for (const lend of lends) {
	  const patronId = lend.patronId;
	  const button =
	    makeElement('button', { class: 'return-book' }, 'Return Book');
	  const patronElement =
	    makeElement('span', { class: 'content' }, patronId);
	  const li = makeElement('li', {}, patronElement, button);
	  ul.append(li);
	  button.addEventListener('click', async ev => {
	    ev.preventDefault();
	    this.clearErrors();
	    await this.returnBook(isbn, patronId);
	  });
	}
      }
    }
  }

  private returnBook = async (isbn: string, patronId: string) => {
    const result = await this.ws.returnBook({patronId, isbn});
    if (result.isOk === false) {
      displayErrors(result.errors);
    }
    else {
      await this.updateBorrowers(isbn);
    }
  }
    

  private checkoutForm(isbn: string) {
    const form = makeElement('form', { class: 'grid-form' });
    addInputWidget(form, 'Patron ID', 'patronId');
    const submit = makeElement('button', {type: 'submit'}, 'Checkout Book');
    form.append(makeElement('span'), submit);
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      this.clearErrors();
      const widget = form.querySelector('#patronId') as HTMLInputElement;
      const patronId = widget.value;
      const lend = { patronId, isbn };
      const result = await this.ws.checkoutBook(lend);
      if (result.isOk === false) {
	displayErrors(result.errors);
      }
      else {
	this.updateBorrowers(isbn);
      }
    });
    return form;
  }

  private displayBook(book: Lib.XBook) {
    const dl = makeElement('dl', { class: 'book-details' });
    addDefListElement(book, 'isbn', 'ISBN', dl);
    addDefListElement(book, 'title', 'Title', dl);
    dl.append(makeElement('dt', {}, 'Authors'));
    dl.append(makeElement('dd', {}, book.authors.join('; ')));
    addDefListElement(book, 'pages', 'Number of Pages', dl);
    addDefListElement(book, 'publisher', 'Publisher', dl);
    addDefListElement(book, 'nCopies', 'Number of Copies', dl);
    dl.append(makeElement('dt', {}, 'Borrowers'));
    dl.append(makeElement('dd', {id: 'borrowers'}));
    return dl;
  }

  /** unwrap a result, displaying errors if !result.isOk, 
   *  returning T otherwise.   Use as if (unwrap(result)) { ... }
   *  when T !== void.
   */
  private unwrap<T>(result: Errors.Result<T>) {
    if (result.isOk === false) {
      displayErrors(result.errors);
    }
    else {
      return result.val;
    }
  }

  /** clear out all errors */
  private clearErrors() {
    this.errors.innerHTML = '';
    document.querySelectorAll(`.error`).forEach( el => {
      el.innerHTML = '';
    });
  }

} //class App

/** Display errors. If an error has a widget or path widgetId such
 *  that an element having ID `${widgetId}-error` exists,
 *  then the error message is added to that element; otherwise the
 *  error message is added to the element having to the element having
 *  ID `errors` wrapped within an `<li>`.
 */  
function displayErrors(errors: Errors.Err[]) {
  for (const err of errors) {
    const id = err.options.widget ?? err.options.path;
    const widget = id && document.querySelector(`#${id}-error`);
    if (widget) {
      widget.append(err.message);
    }
    else {
      const li = makeElement('li', {class: 'error'}, err.message);
      document.querySelector(`#errors`)!.append(li);
    }
  }
}

function addDefListElement(book: Lib.XBook, key: keyof Lib.XBook, label: string,
			   dl: HTMLElement) {
  dl.append(makeElement('dt', {}, label));
  dl.append(makeElement('dd', {}, String(book[key])));
}

function addInputWidget(form: HTMLElement, label: string, id: string) {
  const labelElement = makeElement('label', {for: id}, label);
  const widgetSpan = makeElement('span');
  const widget = makeElement('input', { id, });
  const br = makeElement('br');
  const err = makeElement('span', { class: 'error', id: `${id}-error` });
  widgetSpan.append(widget, br, err);
  form.append(labelElement, widgetSpan);
  return widget;
}
