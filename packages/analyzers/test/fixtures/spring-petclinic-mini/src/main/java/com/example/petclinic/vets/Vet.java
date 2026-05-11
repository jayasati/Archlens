package com.example.petclinic.vets;

public class Vet {
  private final Long id;
  private final String name;

  public Vet(Long id, String name) {
    this.id = id;
    this.name = name;
  }

  public Long getId() {
    return id;
  }

  public String getName() {
    return name;
  }
}
