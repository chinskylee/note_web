// Programming
// Notes on programming languages, algorithms, and software engineering

= Programming

== Algorithms

=== Big O Notation

$O(g(n)) = {f(n): "there exists positive constants" c, n_0 "s.t." 0 <= f(n) <= c g(n) "for all" n >= n_0}$

Common complexities:

$O(1)$ — Constant
$O(log n)$ — Logarithmic
$O(n)$ — Linear
$O(n log n)$ — Linearithmic
$O(n^2)$ — Quadratic
$O(2^n)$ — Exponential

=== Binary Search

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

=== Quicksort

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[0]
    left  = [x for x in arr[1:] if x <= pivot]
    right = [x for x in arr[1:] if x > pivot]
    return quicksort(left) + [pivot] + quicksort(right)
```

== Data Structures

=== Hash Table

A hash table maps keys to values using a hash function:

$h: K arrow {0, 1, ..., m-1}$

Collision resolution strategies:

- *Chaining*: each bucket holds a linked list
- *Open addressing*: probe for the next empty slot

=== Binary Search Tree

- *In-order*: left, root, right
- *Pre-order*: root, left, right
- *Post-order*: left, right, root

== Functional Programming

=== Higher-Order Functions

```haskell
map :: (a -> b) -> [a] -> [b]
filter :: (a -> Bool) -> [a] -> [a]
foldr :: (a -> b -> b) -> b -> [a] -> b
```

=== Monads

A monad is defined by three laws:

#set list(marker: [—])

1. *Left identity*: $"return" x >>= f = f x$
2. *Right identity*: $m >>= "return" = m$
3. *Associativity*: $(m >>= f) >>= g = m >>= (x arrow f x >>= g)$

#set list(marker: [-])

== System Design

=== CAP Theorem

A distributed system can only guarantee two of three:

- *Consistency* — Every read receives the most recent write
- *Availability* — Every request receives a response
- *Partition tolerance* — System continues despite network failures

=== Useful Formulas

Amdahl's Law for parallel speedup:

$S(n) = 1 / ((1 - p) + p / n)$

where $p$ is the parallelisable fraction and $n$ is the number of processors.
