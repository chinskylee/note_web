// Mathematics
// A collection of mathematical concepts and formulas

= Mathematics

== Linear Algebra

=== Vector Spaces

A vector space $V$ over a field $FF$ is a set equipped with two operations:

- *Vector addition*: $V times V arrow V$
- *Scalar multiplication*: $FF times V arrow V$

Satisfying the following axioms for all $u, v, w in V$ and $a, b in FF$:

1. $u + (v + w) = (u + v) + w$ — Associativity
2. $u + v = v + u$ — Commutativity
3. $exists bold(0) in V: v + bold(0) = v$ — Identity
4. $exists -v in V: v + (-v) = bold(0)$ — Inverse

=== Linear Transformations

A linear transformation $T: V arrow W$ satisfies:

$T(a v + b w) = a T(v) + b T(w)$

The *kernel* of $T$ is: $"ker"(T) = {v in V : T(v) = bold(0)}$

The *image* of $T$ is: $"Im"(T) = {T(v) : v in V}$

=== Eigenvalues and Eigenvectors

For a square matrix $A$, $lambda$ is an eigenvalue if there exists a non-zero vector $v$ such that:

$A v = lambda v$

The characteristic polynomial is:

$p(lambda) = det(A - lambda I) = 0$

== Calculus

=== Limits

The limit of $f(x)$ as $x$ approaches $a$:

$lim_(x arrow a) f(x) = L$

=== Derivatives

The derivative of $f$ at $x$:

$(dif) / (dif x) f(x) = lim_(h arrow 0) (f(x + h) - f(x)) / h$

=== Integrals

$integral_a^b f(x) dif x = F(b) - F(a)$

where $F'(x) = f(x)$

== Probability

=== Bayes' Theorem

$P(A | B) = (P(B | A) P(A)) / (P(B))$

=== Expected Value

For a discrete random variable $X$:

$EE[X] = sum_k k P(X = k)$

=== Normal Distribution

$f(x) = 1 / (sigma sqrt(2 pi)) "exp"(-(x - mu)^2 / (2 sigma^2))$
