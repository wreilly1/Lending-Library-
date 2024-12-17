import { Errors } from 'cs544-js-utils';

//types defined in library.ts in earlier projects
import * as Lib from 'library-types';

import { NavLinks, Link, LinkedResult, PagedEnvelope, SuccessEnvelope }
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
    //TODO: add search handler
    const searchWidget = document.querySelector<HTMLElement>('#search');
    if (searchWidget) {
      searchWidget.addEventListener('blur', this.handleSearchBlur);
    } else {
      console.warn('#search widget not found');
    }
  }
  
  //TODO: add private methods as needed


private async fetchAndDisplaySearchResults(url: URL): Promise<void> {
    const result = await this.ws.findBooksByUrl(url);

    if (!result.isOk) {
        // Provide the appropriate error message and target widget
        this.clearErrors();
        displayErrors([Errors.error("Invalid search.", { widget: "search" })]);
        
    } else {
         this.clearErrors();
        const pagedEnvelope = result.val;
        this.displaySearchResults(pagedEnvelope.result, pagedEnvelope.links);
    }
}

    private displaySearchResults(books: LinkedResult<Lib.XBook>[], links?: NavLinks): void {
        this.result.innerHTML = ""; // Clear previous results
        if (links) this.addScrollControls(links);

        const ul = makeElement("ul", { id: "search-results" });
        books.forEach(book => {
            const li = makeElement("li");
            const content = makeElement("span", { class: "content" }, book.result.title || "Untitled");
            const details = makeElement("a", { class: "details", href: "#" }, "details...");
            li.append(content, details);
            if (book.links?.self) this.addDetailsHandler(details, book.links.self);
            ul.append(li);
        });
        this.result.append(ul);
        if (links) this.addScrollControls(links);
    }

    private handleSearchBlur = async (event: FocusEvent) => {
        const searchQuery = (event.target as HTMLInputElement)?.value?.trim();
        if (!searchQuery) {
        this.clearErrors();
            displayErrors([Errors.error("Search query is required. ", { widget: "search" })]);
             this.clearErrors();
            return;
        }

        const url = new URL(this.wsUrl + '/api/books');
        url.searchParams.set('search', searchQuery);
        await this.fetchAndDisplaySearchResults(url);
    };

    private addScrollControls(links: NavLinks): void {
        const scrollDiv = makeElement("div", { class: "scroll" });

        if (links.prev) {
            const prevLink = makeElement("a", { rel: "prev", href: "#" }, "<<");
            prevLink.addEventListener("click", (event) => {
                event.preventDefault();
                this.fetchAndDisplaySearchResults(new URL(links.prev.href));
            });
            scrollDiv.append(prevLink);
        }

        if (links.next) {
            const nextLink = makeElement("a", { rel: "next", href: "#" }, ">>");
            nextLink.addEventListener("click", (event) => {
                event.preventDefault();
                this.fetchAndDisplaySearchResults(new URL(links.next.href));
            });
            scrollDiv.append(nextLink);
        }

        this.result.append(scrollDiv);
    }

  private async fetchBookDetails(url: URL): Promise<void> {
    const result = await this.ws.getBookByUrl(url);

    if (!result.isOk) {
        // Provide the appropriate error message and target widget
        this.clearErrors();
        displayErrors([Errors.error("Failed to fetch book details. ", { widget: "result" })]);
    } else {
        
        this.displayBookDetails(result.val.result);
    }
}

   private displayBookDetails(book: Lib.XBook): void {
    this.result.innerHTML = ""; // Clear previous results

    const dl = makeElement("dl", { class: "book-details" });
    const addDetail = (title: string, value: string | number | undefined): void => {
        const dt = makeElement("dt", {}, title);
        const dd = makeElement("dd", {}, value?.toString() ?? "None");
        dl.append(dt, dd);
    };

    addDetail("ISBN", book.isbn);
    addDetail("Title", book.title);
    addDetail("Authors", book.authors?.join("; "));
    addDetail("Number of Pages", book.pages);
    addDetail("Publisher", book.publisher);
    addDetail("Number of Copies", book.nCopies);

    const borrowers = makeElement("dd", { id: "borrowers" }, "Loading...");
dl.append(makeElement("dt", {}, "Borrowers"), borrowers);

this.result.append(dl);
    // Fetch and display the borrowers
    this.updateBorrowers(book.isbn);

    

    const form = makeElement("form", { class: "grid-form" });
    form.innerHTML = `
        <label for="patronId">Patron ID</label>
        <span>
            <input id="patronId"><br>
            <span class="error" id="patronId-error"></span>
        </span>
        <button type="submit">Checkout Book</button>
    `;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const patronId = (document.getElementById("patronId") as HTMLInputElement).value.trim();
        if (patronId) {
            await this.checkoutBookHandler(book.isbn, patronId);
        } else {
        this.clearErrors();
            displayErrors([Errors.error("Patron ID is required. ", { widget: "patronId" })]);
        }
    });

    this.result.append(form);
}

private async checkoutBookHandler(isbn: string, patronId: string): Promise<void> {
    const result = await this.ws.checkoutBook({ isbn, patronId });
    console.log("Checkout result:", result); // Print the result to the console

    if (!result.isOk) {
        // Provide the appropriate error message and target widget
        this.clearErrors();
        displayErrors([Errors.error("Failed to checkout the book.", { widget: "patronId" })]);
    } else {
        console.log("Book checked out successfully."); // Log success message
        this.clearErrors();
        this.updateBorrowers(isbn);
    }
}


private async updateBorrowers(isbn: string): Promise<void> {
    const borrowersElement = document.getElementById("borrowers");
    if (!borrowersElement) {
        console.error("Borrowers element not found in the DOM.");
        return;
    }

    borrowersElement.textContent = "Loading..."; // Display a loading message

    try {
        const result = await this.ws.getLends(isbn);

        if (!result.isOk) {
            borrowersElement.textContent = "Failed to load borrowers.";
            this.clearErrors();
            displayErrors([Errors.error("Failed to fetch borrowers. Please try again.", { widget: "borrowers" })]);
        } else {
            const lends = result.val;

            if (lends.length === 0) {
                borrowersElement.textContent = "None";
            } else {
                borrowersElement.innerHTML = ""; // Clear "Loading..."
                const ul = makeElement("ul");
                lends.forEach((lend) => {
                    const li = makeElement("li");
                    const content = makeElement("span", { class: "content" }, lend.patronId);
                    const button = makeElement("button", { class: "return-book" }, "Return Book");

                    button.addEventListener("click", async () => {
                        const returnResult = await this.ws.returnBook({ isbn, patronId: lend.patronId });
this.clearErrors();
                        if (!returnResult.isOk) {
                        this.clearErrors();
                            displayErrors([Errors.error("Failed to return the book. Please try again.", { widget: "borrowers" })]);
                        } else {
                            this.updateBorrowers(isbn);
                        }
                    });

                    li.append(content, button);
                    ul.append(li);
                });
                borrowersElement.append(ul);
            }
        }
    } catch (error) {
        borrowersElement.textContent = "An error occurred while loading borrowers.";
        this.clearErrors();
        displayErrors([Errors.error("Unexpected error while fetching borrowers.", { widget: "borrowers" })]);
    }
    this.clearErrors();
}

private addDetailsHandler(detailsLink: HTMLElement, selfLink: Link): void {
    detailsLink.addEventListener("click", (event) => {
        event.preventDefault();

        this.fetchBookDetails(new URL(selfLink.href)).catch(() => {
            // Provide an appropriate error message for fetching book details
            this.clearErrors();
            displayErrors([Errors.error("Failed to load book details. ", { widget: "result" })]);
        });
    });
    this.clearErrors();
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


//TODO: add functions as needed
