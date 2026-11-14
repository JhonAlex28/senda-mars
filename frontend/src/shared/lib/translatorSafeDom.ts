/**
 * Compatibilidad con el traductor del navegador (Google Translate, Edge, etc.).
 *
 * El traductor reemplaza los nodos de texto por elementos <font>. Cuando React luego
 * intenta quitar o insertar junto a un nodo que ya no está donde lo dejó, el DOM lanza
 * "NotFoundError" y la app se cae. Este parche hace que esas dos operaciones toleren
 * el cambio en lugar de fallar (solución conocida: facebook/react#11538).
 */
export function makeDomTranslatorSafe(): void {
  const proto = Node.prototype;

  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      return child; // el traductor ya lo movió: no hay nada que quitar aquí
    }
    return removeChild.call(this, child) as T;
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      return insertBefore.call(this, node, null) as T; // referencia movida: se agrega al final
    }
    return insertBefore.call(this, node, ref) as T;
  };
}
